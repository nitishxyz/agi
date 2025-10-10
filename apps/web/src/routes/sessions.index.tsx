import { createFileRoute } from '@tanstack/react-router';
import { SessionsLayout } from '../components/sessions/SessionsLayout';

export const Route = createFileRoute('/sessions/')({
	component: SessionsIndexRoute,
});

function SessionsIndexRoute() {
	return <SessionsLayout />;
}
