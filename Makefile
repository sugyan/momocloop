TESTS = $(shell find test/*.js)

test:
	./node_modules/.bin/nodeunit $(TESTS)

.PHONY: test
