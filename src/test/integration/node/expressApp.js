const express = require(`express@${process.env.EXPRESS_VERSION}`);
const bodyParser = require("body-parser");
const app = express();
const axios = require("axios");
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

const init = () => {
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

	const server = app.listen(0, () => {
		const port = server.address().port;
		console.log("Listening on port " + port);
		if (process.send) {
			process.send(port);
		} else {
			console.log(`PORT:${port}`);
		}
	});
};

module.exports = {
	init
};
