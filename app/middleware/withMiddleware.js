// In your withMiddleware.js file
export function withMiddleware(handler, middleware) {
  return async (req, context) => {
    // Apply middleware
    await middleware(req, context);

    // Call the handler, passing both req and context
    return handler(req, context);
  };
}
