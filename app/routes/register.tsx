import { useLoaderData } from "react-router";
import { RegisterPage } from "./register/register-page";
import type { loader } from "./register/route.server";

export { loader } from "./register/route.server";

export default function Register() {
	return <RegisterPage data={useLoaderData<typeof loader>()} />;
}
