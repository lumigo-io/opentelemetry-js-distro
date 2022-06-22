const express = require('express');
const lumigoWrapper = require("@lumigo/opentelemetry");
lumigoWrapper.trace('XXXXX', 'orr1');

const axios = require("axios");
const bodyParser = require('body-parser')
const app = express();
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())


app.get('/chucknorris', async  (req, res) => {
	const response = await axios.get('https://api.chucknorris.io/jokes/random', {
		headers: {
			header: "a"
		}
	})
	res.send(response.data).status(200);
});

const server = app.listen(80, () => {
	const port2 = server.address().port;
	console.log('Listening on port ' + port2);
	// process.send(port);
});
