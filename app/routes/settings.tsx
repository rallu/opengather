import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export async function loader(_: LoaderFunctionArgs) {
	return redirect("/profile");
}

export async function action(_: ActionFunctionArgs) {
	return redirect("/profile");
}

export default function SettingsRedirectPage() {
	return null;
}
