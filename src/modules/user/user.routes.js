import { authenticationMiddleware } from "@/lib/middlewares/authentication"
import { getUser } from "./user.actions"

export default function userRoutes(fastify) {
  // // Public - Signup
  // fastify.post(
  //   "/users/signup",
  //   {
  //     preHandler: [signupValidator],
  //   },
  //   UserActions.signup()
  // )

  // Authenticated - Get own profile
  fastify.get(
    "/me",
    {
      preHandler: [authenticationMiddleware],
    },
    getUser
  )

  // // Authenticated - Update profile
  // fastify.patch(
  //   "/users/me",
  //   {
  //     preHandler: [authenticationMiddleware(), updateProfileValidator],
  //   },
  //   UserActions.updateProfile()
  // )

  // // Authenticated - Update password
  // fastify.patch(
  //   "/users/me/password",
  //   {
  //     preHandler: [authenticationMiddleware(), updatePasswordValidator],
  //   },
  //   UserActions.updatePassword()
  // )

  // // Premium - Update advanced profile
  // fastify.patch(
  //   "/users/me/advanced",
  //   {
  //     preHandler: [
  //       authenticationMiddleware(),
  //       checkSubscription("premium"),
  //       updateProfileValidator,
  //     ],
  //   },
  //   UserActions.updateAdvancedProfile()
  // )

  // // Admin only - Delete user
  // fastify.delete(
  //   "/users/:id",
  //   {
  //     preHandler: [authenticationMiddleware(), requireRole("admin")],
  //   },
  //   UserActions.deleteUser()
  // )
}
