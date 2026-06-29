import { handler } from './build/handler.js';
import express from 'express';

const app = express();

app.get('/healthcheck', (req, res) => {
	res.end('ok');
});

app.use(handler);

app.listen(3000, () => {
	console.log('listening');
});