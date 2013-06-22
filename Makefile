
serve: node_modules
	@nodemon index.js || node index.js

node_modules: package.json
	npm install

