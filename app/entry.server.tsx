import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { captureMonitoredError } from "./server/error-monitoring.server";
import { getRequestId, logError } from "./server/logger.server";

export default async function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	routerContext: EntryContext,
	_loadContext: AppLoadContext,
) {
	let shellRendered = false;
	const userAgent = request.headers.get("user-agent");
	const requestId = getRequestId(request);

	const body = await renderToReadableStream(
		<ServerRouter context={routerContext} url={request.url} />,
		{
			onError(error: unknown) {
				responseStatusCode = 500;
				// Log streaming rendering errors from inside the shell.  Don't log
				// errors encountered during initial shell rendering since they'll
				// reject and get logged in handleDocumentRequest.
				if (shellRendered) {
					void captureMonitoredError({
						event: "server.render.error",
						error,
						request,
						tags: {
							component: "entry.server",
						},
					});
					logError({
						event: "server.render.error",
						data: {
							requestId,
							path: new URL(request.url).pathname,
							error: error instanceof Error ? error.message : "render_error",
						},
					});
				}
			},
		},
	);
	shellRendered = true;

	// Ensure requests from bots and SPA Mode renders wait for all content to load before responding
	// https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
	if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
		await body.allReady;
	}

	responseHeaders.set("Content-Type", "text/html");
	responseHeaders.set("X-Request-Id", requestId);
	return new Response(body, {
		headers: responseHeaders,
		status: responseStatusCode,
	});
}
