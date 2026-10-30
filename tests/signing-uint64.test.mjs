import assert from 'node:assert/strict';
import test from 'node:test';
import Long from 'long';
import protobuf from 'protobufjs';
import { serializeSignDoc } from '@cosmjs/amino';
import { Secp256k1, Secp256k1Signature, keccak256 } from '@cosmjs/crypto';
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys.js';
import { AuthInfo, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx.js';
import { MsgDelegate } from 'cosmjs-types/cosmos/staking/v1beta1/tx.js';
import DefaultSigningAdapter from '../src/adapters/DefaultSigningAdapter.mjs';

const network = { chainId: 'epix_1916-1', path: 'epix', ethermint: true, aminoPreventTypes: [] };
const boundaries = [0n, 1n, (1n<<31n)-1n, 1n<<31n, (1n<<32n)-1n, 1n<<32n, (1n<<53n)-1n, 1n<<53n, (1n<<53n)+1n, (1n<<63n)-1n, 1n<<63n, (1n<<63n)+1n, (1n<<64n)-1n];
const account = value => ({ address: 'epix1fixture', account_number: value.toString(), sequence: value.toString() });
const fee = { amount: [{ denom: 'aepix', amount: '1' }], gas: '200000' };
const params = { delegatorAddress: 'epix1fixture', validatorAddress: 'epixvaloper1fixture', amount: { denom: 'aepix', amount: '1000000000000000001' } };
const message = { typeUrl: '/cosmos.staking.v1beta1.MsgDelegate', forNetwork() { return this; },
  toAmino() { return { type: 'cosmos-sdk/MsgDelegate', value: { delegator_address: params.delegatorAddress, validator_address: params.validatorAddress, amount: { ...params.amount } } }; },
  toProto() { return { typeUrl: this.typeUrl, value: MsgDelegate.encode(params).finish() }; } };
const privateFixture = new Uint8Array(32); privateFixture[31] = 1; // public disposable test key
const publicFixture = Secp256k1.compressPubkey((await Secp256k1.makeKeypair(privateFixture)).pubkey);
const signerAccount = { address: 'epix1fixture', pubkey: publicFixture };
const root = protobuf.parse(`syntax="proto3";
message Any { string type_url=1; bytes value=2; }
message Coin { string denom=1; string amount=2; }
message ModeSingle { int32 mode=1; }
message ModeInfo { ModeSingle single=1; }
message SignerInfo { Any public_key=1; ModeInfo mode_info=2; uint64 sequence=3; }
message Fee { repeated Coin amount=1; uint64 gas_limit=2; string payer=3; string granter=4; }
message AuthInfo { repeated SignerInfo signer_infos=1; Fee fee=2; }
message SignDoc { bytes body_bytes=1; bytes auth_info_bytes=2; string chain_id=3; uint64 account_number=4; }`).root;
const encode = (name, data) => { const type=root.lookupType(name); return type.encode(type.fromObject(data)).finish(); };
const directBytes = doc => encode('SignDoc', { bodyBytes:doc.bodyBytes, authInfoBytes:doc.authInfoBytes, chainId:doc.chainId, ...(BigInt(doc.accountNumber.toString())===0n?{}:{accountNumber:doc.accountNumber}) });
async function signature(bytes) { return (await Secp256k1.createSignature(keccak256(bytes), privateFixture)).toFixedLength().slice(0,64); }
async function verify(bytes, signed) { assert.equal(await Secp256k1.verifySignature(Secp256k1Signature.fromFixedLength(signed),keccak256(bytes),publicFixture),true); }
function provider(overrides={}) { return { getAccounts:async()=>[signerAccount], signAminoSupport:()=>false, signDirectSupport:()=>true, ...overrides }; }

test('Amino signs exact uint64 account numbers and sequences without a Uint53 conversion', async()=>{
  for(const value of [14353137888589996058n, ...boundaries]) {
    let document;
    const adapter=new DefaultSigningAdapter(network,provider({signAminoSupport:()=>true,signAmino:async(address,doc)=>{
      assert.equal(address,signerAccount.address); document=structuredClone(doc);
      assert.equal(doc.account_number,value.toString()); assert.equal(doc.sequence,value.toString());
      return {signed:doc,signature:{signature:Buffer.from(await signature(serializeSignDoc(doc))).toString('base64')}};
    }}));
    const raw=await adapter.sign(account(value),[message],'fixture',fee);
    const auth=AuthInfo.decode(raw.authInfoBytes);
    assert.equal(auth.signerInfos[0].sequence,value);
    assert.deepEqual(TxBody.decode(raw.bodyBytes).messages[0].value,message.toProto().value);
    await verify(serializeSignDoc(document),raw.signatures[0]);
  }
});

test('AuthInfo sequence and gas match independent protobuf bytes at all uint64 boundaries',async()=>{
  const adapter=new DefaultSigningAdapter(network,provider());
  for(const value of boundaries) {
    const bytes=await adapter.makeAuthInfoBytes(account(value),{amount:fee.amount,gasLimit:value.toString()},1);
    const expected=encode('AuthInfo',{signerInfos:[{publicKey:{typeUrl:'/ethermint.crypto.v1.ethsecp256k1.PubKey',value:PubKey.encode({key:publicFixture}).finish()},modeInfo:{single:{mode:1}},...(value===0n?{}:{sequence:value.toString()})}],fee:{amount:fee.amount,...(value===0n?{}:{gasLimit:value.toString()})}});
    assert.equal(AuthInfo.decode(bytes).signerInfos[0].sequence,value);
    assert.equal(AuthInfo.decode(bytes).fee.gasLimit,value);
    // An explicit zero and an omitted protobuf default are both valid.
    if(value!==0n) assert.deepEqual(Buffer.from(bytes),Buffer.from(expected),value.toString());
  }
});

test('direct signing preserves unsigned account identity and the returned signed bytes',async()=>{
  for(const value of boundaries) {
    let returned;
    const adapter=new DefaultSigningAdapter(network,provider({signDirect:async(_,doc)=>{
      assert.equal(doc.accountNumber,value); returned={...doc,accountNumber:Long.fromString(value.toString())};
      const sig=await signature(directBytes({...returned,accountNumber:value}));
      return {signed:returned,signature:{signature:Buffer.from(sig).toString('base64')}};
    }}));
    const raw=await adapter.sign(account(value),[message],'fixture',fee);
    assert.deepEqual(raw.bodyBytes,returned.bodyBytes); assert.deepEqual(raw.authInfoBytes,returned.authInfoBytes);
    await verify(directBytes({...returned,accountNumber:value}),raw.signatures[0]);
  }
});

test('unsafe, negative and overflowing request values fail before wallet signing',async()=>{
  for(const value of [-1,'-1',Number(9007199254740993n),'18446744073709551616']) {
    let calls=0;
    const adapter=new DefaultSigningAdapter(network,provider({signAminoSupport:()=>true,signAmino:async()=>{calls++;throw Error('wallet called');}}));
    await assert.rejects(adapter.sign({...account(1n),account_number:value},[message],'fixture',fee));
    assert.equal(calls,0);
    await assert.rejects(adapter.makeAuthInfoBytes({...account(1n),sequence:value},{amount:fee.amount,gasLimit:'1'},1));
  }
});

test('Amino rejects changed identity or messages, including in-place changes, without retrying direct',async()=>{
  for(const change of [doc=>{doc.chain_id='other'},doc=>{doc.account_number='2'},doc=>{doc.sequence='2'},doc=>{doc.timeout_height='1'},doc=>{doc.timeout_height='0'},doc=>{doc.msgs[0].value.amount.amount='2'}]) {
    let calls=0,directCalls=0;
    const adapter=new DefaultSigningAdapter(network,provider({signAminoSupport:()=>true,signAmino:async(_,doc)=>{calls++;change(doc);return {signed:doc,signature:{signature:''}}},signDirect:async()=>{directCalls++}}));
    await assert.rejects(adapter.sign(account(1n),[message],'fixture',fee),/changed/);
    assert.equal(calls,1);assert.equal(directCalls,0);
  }
});

test('direct rejects changed chain, account bits, signer or messages before assembling a transaction',async()=>{
  const mutations=[doc=>{doc.chainId='other'},doc=>{doc.accountNumber=Long.fromString('18446744073709551614')},doc=>{doc.accountNumber='-1'},doc=>{doc.accountNumber=-1},doc=>{doc.accountNumber=Object.assign(Long.fromString('18446744073709551615'),{high:NaN})},doc=>{
    const auth=AuthInfo.decode(doc.authInfoBytes);auth.signerInfos[0].sequence=2n;doc.authInfoBytes=AuthInfo.encode(auth).finish();
  },doc=>{
    const auth=AuthInfo.decode(doc.authInfoBytes);auth.signerInfos[0].publicKey.value=new Uint8Array();doc.authInfoBytes=AuthInfo.encode(auth).finish();
  },doc=>{
    const body=TxBody.decode(doc.bodyBytes);body.messages=[];doc.bodyBytes=TxBody.encode(body).finish();
  }];
  for(const change of mutations) {
    let calls=0;
    const adapter=new DefaultSigningAdapter(network,provider({signDirect:async(_,doc)=>{calls++;change(doc);return {signed:doc,signature:{signature:''}}}}));
    await assert.rejects(adapter.sign(account((1n<<64n)-1n),[message],'fixture',fee));
    assert.equal(calls,1);
  }
});

test('Amino retains the approved memo and exact fee fields in the verifiable transaction',async()=>{
  let document;
  const adapter=new DefaultSigningAdapter(network,provider({signAminoSupport:()=>true,signAmino:async(_,doc)=>{
    doc.memo='wallet reviewed memo';
    doc.fee={amount:[{denom:'aepix',amount:'2'}],gas:'4294967295',payer:'epix1fixture',granter:'epix1granter'};
    document=structuredClone(doc);
    return {signed:doc,signature:{signature:Buffer.from(await signature(serializeSignDoc(doc))).toString('base64')}};
  }}));
  const raw=await adapter.sign(account(14353137888589996058n),[message],'original',fee);
  const auth=AuthInfo.decode(raw.authInfoBytes),body=TxBody.decode(raw.bodyBytes);
  assert.equal(body.memo,document.memo);
  assert.deepEqual(body.messages[0].value,message.toProto().value);
  const reconstructed={...document,memo:body.memo,sequence:auth.signerInfos[0].sequence.toString(),fee:{amount:auth.fee.amount,gas:auth.fee.gasLimit.toString(),payer:auth.fee.payer,granter:auth.fee.granter}};
  assert.deepEqual(reconstructed,document);
  await verify(serializeSignDoc(reconstructed),raw.signatures[0]);
});

test('the signer account must match the requested address',async()=>{
  const adapter=new DefaultSigningAdapter(network,provider({getAccounts:async()=>[{address:'other',pubkey:Uint8Array.of(1)},signerAccount]}));
  const bytes=await adapter.makeAuthInfoBytes(account(1n),{amount:[],gasLimit:'1'},1);
  assert.deepEqual(PubKey.decode(AuthInfo.decode(bytes).signerInfos[0].publicKey.value).key,publicFixture);
  adapter.signerProvider.getAccounts=async()=>[{address:'other',pubkey:publicFixture}];
  await assert.rejects(adapter.makeAuthInfoBytes(account(1n),{amount:[],gasLimit:'1'},1),/retrieve account/);
});

test('Terra and Injective retain normal Amino and direct adapter behavior',async()=>{
  const {default:TerraSigningAdapter}=await import('../src/adapters/TerraSigningAdapter.mjs');
  const {default:InjectiveSigningAdapter}=await import('../src/adapters/InjectiveSigningAdapter.mjs');
  for(const [Adapter,path,keyType] of [[TerraSigningAdapter,'terra','/cosmos.crypto.secp256k1.PubKey'],[InjectiveSigningAdapter,'injective','/injective.crypto.v1beta1.ethsecp256k1.PubKey']]) {
    for(const amino of [false,true]) {
      const calls=[];
      const signer=provider({isLedger:()=>false,signAminoSupport:()=>amino,signAmino:async(_,doc)=>{calls.push('amino');assert.equal(doc.account_number,'15');assert.equal(doc.sequence,'15');return {signed:doc,signature:{signature:Buffer.alloc(64).toString('base64')}}},signDirect:async(_,doc)=>{calls.push('direct');assert.equal(doc.accountNumber,15n);return {signed:doc,signature:{signature:Buffer.alloc(64).toString('base64')}}}});
      const adapter=new Adapter({...network,path,ethermint:false},signer);
      const raw=await adapter.sign(account(15n),[message],'fixture',fee);
      const auth=AuthInfo.decode(raw.authInfoBytes);
      assert.deepEqual(calls,[amino?'amino':'direct']);
      assert.equal(auth.signerInfos[0].sequence,15n);
      assert.equal(auth.signerInfos[0].publicKey.typeUrl,keyType);
      assert.deepEqual(TxBody.decode(raw.bodyBytes).messages[0].value,message.toProto().value);
    }
  }
});

test('Injective Ledger retains its EIP712 timeout height through the inherited encoder',async()=>{
  const {default:InjectiveSigningAdapter}=await import('../src/adapters/InjectiveSigningAdapter.mjs');
  const {MsgDelegate:DelegateMessage}=await import('../src/messages/MsgDelegate.mjs');
  const {toBech32}=await import('@cosmjs/encoding');
  const owner=toBech32('inj',new Uint8Array(20).fill(1));
  const validator=toBech32('injvaloper',new Uint8Array(20).fill(2));
  const delegate=new DelegateMessage({...params,delegatorAddress:owner,validatorAddress:validator});
  let requested;
  const signer=provider({isLedger:()=>true,getAccounts:async()=>[{...signerAccount,address:owner}],signEIP712:async(chain,address,typed,doc)=>{
    assert.equal(chain,'injective-1');assert.equal(address,owner);requested=doc;
    return {signed:doc,signature:{signature:Buffer.alloc(64).toString('base64')}};
  }});
  const adapter=new InjectiveSigningAdapter({...network,path:'injective',chainId:'injective-1',restClient:{getLatestBlock:async()=>({block:{header:{height:'100'}}})}},signer);
  const raw=await adapter.sign({...account(15n),address:owner},[delegate],'fixture',fee);
  assert.equal(TxBody.decode(raw.bodyBytes).timeoutHeight,BigInt(requested.timeout_height));
  assert.equal(AuthInfo.decode(raw.authInfoBytes).signerInfos[0].sequence,15n);
  assert.equal(TxBody.decode(raw.bodyBytes).messages[0].typeUrl,'/cosmos.staking.v1beta1.MsgDelegate');
});

test('direct signing preserves approved memo and fee edits and their signature',async()=>{
  let returned;
  const adapter=new DefaultSigningAdapter(network,provider({signDirect:async(_,doc)=>{
    const body=TxBody.decode(doc.bodyBytes),auth=AuthInfo.decode(doc.authInfoBytes);
    body.memo='wallet reviewed memo';auth.fee.gasLimit=200001n;auth.fee.amount=[{denom:'aepix',amount:'2'}];
    returned={...doc,bodyBytes:TxBody.encode(body).finish(),authInfoBytes:AuthInfo.encode(auth).finish()};
    return {signed:returned,signature:{signature:Buffer.from(await signature(directBytes(returned))).toString('base64')}};
  }}));
  const raw=await adapter.sign(account(14353137888589996058n),[message],'original',fee);
  assert.deepEqual(raw.bodyBytes,returned.bodyBytes);assert.deepEqual(raw.authInfoBytes,returned.authInfoBytes);
  await verify(directBytes({...returned,bodyBytes:raw.bodyBytes,authInfoBytes:raw.authInfoBytes}),raw.signatures[0]);
});
