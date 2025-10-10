import { createFileRoute } from '@tanstack/react-router';
import { SessionsLayout } from '../components/sessions/SessionsLayout';

export const Route = createFileRoute('/sessions/$sessionId')({
	component: SessionDetailRoute,
});

function SessionDetailRoute() {
	const { sessionId } = Route.useParams();
	return <SessionsLayout sessionId={sessionId} />;
}
