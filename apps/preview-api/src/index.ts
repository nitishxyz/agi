import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { shareRoutes } from './routes/share';
import { ogRoutes } from './routes/og';

const app = new Hono();

app.use(
	'*',
	cors({
		origin: ['https://share.agi.nitish.sh', 'http://localhost:4321'],
		allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'X-Share-Secret'],
	})
);

app.get('/', (c) => {
	return c.json({
		name: 'AGI Share API',
		version: '1.0.0',
		endpoints: {
			'POST /share': 'Create a new share',
			'GET /share/:shareId': 'Get a share',
			'PUT /share/:shareId': 'Update a share',
			'DELETE /share/:shareId': 'Delete a share',
			'GET /og/:shareId': 'Get OG image for a share',
		},
	});
});

app.route('/share', shareRoutes);
app.route('/og', ogRoutes);

export default app;
