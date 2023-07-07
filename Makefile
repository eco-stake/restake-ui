SHELL := /bin/bash

restake: setvars
	docker run --rm -v -p 1000:80 -t ghcr.io/eco-stake/restake-ui
