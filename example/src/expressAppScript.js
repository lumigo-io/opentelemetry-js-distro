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

const server = app.listen(3001, () => {
	// port = server.address().port;
	console.log('Listening on port ' + 3001);
	// process.send(port);
});
