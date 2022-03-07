const express = require('express');
const lumigoWrapper = require("../src/wrapper");
const INTEGRATION_ENDPOINT = "http://ec2-54-218-102-114.us-west-2.compute.amazonaws.com:55681/v1/trace";
lumigoWrapper.trace('t_ad1fddcc0d1e42cf89db1', 'orr4', INTEGRATION_ENDPOINT);

const axios = require("axios");

const AWS = require('aws-sdk');
const awsConfig = require("aws-config");
const  sqs = new AWS.SQS({apiVersion: '2012-11-05', region:"us-east-1"});
const bodyParser = require('body-parser')
const app = express();
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())


const dynamodb = new AWS.DynamoDB({
	region: 'us-east-1'
});
AWS.config.region = 'us-east-1';
AWS.config.update(awsConfig({ profile: 'default' }));
const lambda = new AWS.Lambda();




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


app.get('/sqs', async  (req, res) => {
	const sqsParams = {
		MessageBody: 'Hello world!',
		QueueUrl: "https://sqs.us-east-1.amazonaws.com/767973265310/orr-queue",
		DelaySeconds: 0
	};

	const message = await sqs.sendMessage(sqsParams).promise().catch(e =>{
		console.log('Error while putting record into SQS', e);
	});
	await axios.get('https://api.chucknorris.io/jokes/random', {
		data: {
			a: "a"
		},
		headers: {
			header: "a"
		}
	})
	res.send(message.MessageId).status(200);
});


app.get('/node-container-tracer-test', async (req, res) => {
	const params = {
		FunctionName: 'tracer-test-orrlevinger-dev-test-function', // the lambda function we are going to invoke
		InvocationType: 'RequestResponse',
		LogType: 'Tail',
		Payload: '{"a":2}',
	};
	await lambda.invoke(params).promise();
	console.log('success')
	res.send({a: "test"}).status(200);
});


app.post('/node-container-post-lambda', async (req, res) => {
	// try {
	// 	const resass = await axios.post("http://localhost:3001/node-container-post-dynamodb",{
	// 		id: "a",
	// 		message: "a"
	// 	});
	// 	console.log(resass)
	// } catch (e) {
	// 	console.error('err', e)
	// }
	const params = {
		FunctionName: 'tracer-test-orrlevinger-dev-test-function', // the lambda function we are going to invoke
		InvocationType: 'RequestResponse',
		LogType: 'Tail',
		Payload: '{"a":2}',
	};
	await lambda.invoke(params).promise();
	console.log('success')
	res.send({
		res: "ok"
	}).status(200);
});

app.post('/node-container-post-dynamodb', async (req, res) => {
	try {
		const {body} = req;
		const {id, message} = body;
		const dynamodb = new AWS.DynamoDB();
		const params = {
			TableName: 'test-table',
			Item: {
				id: {S: id},
				message: {S: message},
			},
		};
		await dynamodb
			.putItem(params)
			.promise()
			.catch(e => {
				console.log('Error while putting record into DDB', e);
			});
		res.send({
			res: "ok"
		}).status(200);
	} catch (e) {
		res.send(e).status(500);
	}
});


app.get('/node-container-get-dynamodb', async (req, res) => {
	try {
		const {body} = req;
		const {id} = body;
		const result = await dynamodb
			.getItem({
				Key: {
					"id": {
						S: id
					}
				},
				TableName: "test-table"
			})
			.promise()
			.catch(e => {
				res.send(e).status(500);
			});
		res.send(result).status(200);
	} catch (e) {
		res.send(e).status(500);
	}
});

app.get('/node-container-tracer-test-fail', (req, res) => {
	res.status(400).send('This is an error!');
});

const server = app.listen(3001, () => {
	// port = server.address().port;
	console.log('Listening on port ' + 3001);
	// process.send(port);
});
