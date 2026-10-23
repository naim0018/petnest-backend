// Importing core interfaces, decorators, and exception classes from NestJS framework
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
// Reflector is a utility class provided by NestJS to read custom metadata attached to route handlers or controllers
import { Reflector } from '@nestjs/core';
// Import the custom metadata key string ('roles') used when attaching @Roles() decorator
import { ROLES_KEY } from '../decorators/roles.decoretors';
// Import the TypeScript interface representing the authenticated user payload attached to the request
import { AuthenticatedUser } from './jwt-auth.guard';

// Marks this class as a NestJS injectable provider so the dependency injection container can manage it
@Injectable()
export class RoleGuard implements CanActivate {
  // Injecting the Reflector service through the constructor to read route metadata at runtime
  constructor(private readonly reflector: Reflector) {}

  // The required method from CanActivate interface; determines whether the current request can proceed
  canActivate(
    context: ExecutionContext, // Provides details and utilities about the current execution context (HTTP request/response)
  ): boolean {
    // Extract required roles metadata from the route handler first, falling back to class-level (controller) metadata
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(), // Checks method/handler level (e.g., @Roles('ADMIN') on @Get())
      context.getClass(),   // Checks controller class level (e.g., @Roles('ADMIN') on @Controller())
    ]);

    // If no roles are specified on the endpoint or the array is empty, grant access immediately
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // Switch the context to HTTP and retrieve the underlying Express Request object typed with our user payload
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();

    // Extract the user object that was previously decoded and attached by JwtAuthGuard
    const user = request.user;

    // If there is no user attached or the user object has no role property, deny access with a 403 Forbidden
    if (!user || !user.role) {
      throw new ForbiddenException('Access denied No role assigned');
    }

    // Check if the user's role is included in the list of roles allowed to access this endpoint
    const hasRole = requiredRoles.includes(user.role);

    // If the user's role does not match any required role, deny access with a detailed error message
    if (!hasRole) {
      throw new ForbiddenException(`Access denied: Requires [${requiredRoles.join(', ')}], you have ${user.role}`);
    }

    // If all checks pass, allow the request to proceed to the controller handler
    return true;
  }
}

