import {trace} from "@lumigo/opentelemetry";
trace('XXXXX', 'service-name');
import express from 'express';

import axios from "axios";
import bodyParser from 'body-parser'
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

const server = app.listen(80, () => {
	// @ts-ignore
	const port2 = server.address().port;
	console.log('Listening on port ' + port2);
	// process.send(port);
});
