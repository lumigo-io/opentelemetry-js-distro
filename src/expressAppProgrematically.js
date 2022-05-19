const AWS = require("aws-sdk");
const awsConfig = require("aws-config");
AWS.config.region = "us-west-2";
AWS.config.update(awsConfig({ profile: "Administrator-angels-667799632894" }));
const express = require('express');
const lumigoWrapper = require('./wrapper');
lumigoWrapper.trace("t_ad1fddcc0d1e42cf89db1", 'core-node-master', "https://ux0v98hx7f.execute-api.us-west-2.amazonaws.com/api/spans");

const axios = require("axios");
const bodyParser = require('body-parser')
const app = express();
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())


app.get('/chucknorris', async  (req, res) => {
	const response = await axios.get('https://api.chucknorris.io/jokes/random', {
		data: {
			a: "a"
		},
		headers: {
			header: "a"
		}
	})
	res.send(response.data).status(200);
});


app.post('/lambda', async  (req, res) => {
	const lambda = new AWS.Lambda();
	const params = {
		FunctionName: "orrFunctio2n",
		InvocationType: "RequestResponse",
		LogType: "Tail",
		Payload: '{"a":2}'
	};
	lambda
		.invoke(params)
		.promise()
		.then(result => {
			res.set("Content-Type", "application/json")
				.status(200)
				.send({
					...result
				});
		})
		.catch(e => {
			res.status(500).send(e);
		});
});


app.post('/error-orr',  (req, res,next) => {
	try {
		throw new Error("ERROR 2");
	} catch (e) {
		next(e)
	}
});

const server = app.listen(80, () => {
	const port2 = server.address().port;
	console.log('Listening on port ' + port2);
	// process.send(port);
});
