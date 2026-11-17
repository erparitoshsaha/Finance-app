/**
 * Middleware to authorize specific user roles.
 * Must be mounted AFTER authMiddleware since it relies on req.user.
 */
module.exports = (allowedRoles = []) => {
  if (typeof allowedRoles === 'string') {
    allowedRoles = [allowedRoles];
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Access Denied. Required roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}` 
      });
    }

    next();
  };
};
