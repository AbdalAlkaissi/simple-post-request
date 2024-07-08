const express = require('express')
const bodyParser = require('body-parser');
const app = express()
const port = process.env.PORT || 3000;

// app.get('/sendUID', (req, res) => res.send('Hello World!'))

async function main() {
	try { 
	   app.use(bodyParser.json({ limit: '50mb' })); // Adjust the limit as needed
	   app.post('/sendUID', async (req, res) => {
		   const { UID } = req.body;
		   console.log(req.body); // Log the UID
		   res.send('Received UID: ' + UID); // Send the UID back
	   });
	   app.get('/getUID', async (req, res) => {
		res.send('Received UID: NOTHING'); // Send the UID back
	});
	   app.listen(port, () => {
		 console.log(`Server is running on port ${port}`);
	   });

	} catch (error) {
	   console.error("Error in main:", error);
	}
}
   // Call the main function during server startup
main().catch(console.error);