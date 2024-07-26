export function withMiddleware(handler, middleware) {
  return async (req) => {
    const middlewareResponse = await middleware(req);
    if (middlewareResponse) {
      return middlewareResponse; // If middleware returns a response, stop and return it
    }
    return handler(req);
  };
}
