import { Redirect } from 'expo-router';
import { useLearnerSession } from '../features/session/session-store';
export default function Index() { const session = useLearnerSession((state) => state.session); return <Redirect href={session ? session.profile.selectedLicenseClass ? '/home' : '/settings' : '/login'} />; }
