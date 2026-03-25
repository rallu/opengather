import type { RegisterLoaderData } from "./route.server";
import { RegisterForm } from "./register-form";
import { useRegisterActions } from "./use-register-actions";

export function RegisterPage(props: { data: RegisterLoaderData }) {
	const actions = useRegisterActions({
		googleAuthEnabled: props.data.googleAuthEnabled,
		hubAuthEnabled: props.data.hubAuthEnabled,
		nextPath: props.data.nextPath,
	});

	return (
		<div className="flex min-h-screen items-center justify-center p-8">
			<RegisterForm
				error={actions.error}
				googleAuthEnabled={props.data.googleAuthEnabled}
				hubAuthEnabled={props.data.hubAuthEnabled}
				hubLoading={actions.hubLoading}
				isAnyLoading={actions.isAnyLoading}
				loading={actions.loading}
				email={actions.email}
				name={actions.name}
				nextPath={props.data.nextPath}
				password={actions.password}
				reason={props.data.reason}
				serverDescription={props.data.serverDescription}
				serverName={props.data.serverName}
				socialLoading={actions.socialLoading}
				onEmailChange={actions.setEmail}
				onGoogleRegister={actions.handleGoogleRegister}
				onHubRegister={actions.handleHubRegister}
				onNameChange={actions.setName}
				onPasswordChange={actions.setPassword}
				onSubmit={actions.handleSubmit}
			/>
		</div>
	);
}
