import { FastifyPluginAsync } from "fastify";

const privateRoutes: FastifyPluginAsync = async (app) => {
  app.get("/profile", { preHandler: [app.authenticate] }, async (req, res) => {
    try {
      // Check if the user object exists and contains a valid ID
      if (!req.user || !req.user.id) {
        return res
          .status(401)
          .send({ error: "Unauthorized: Missing or invalid user ID" });
      }

      // Fetch the user from the database using the ID from the token
      const foundAccount = await app.prisma.user.findUnique({
        where: { id: req.user.id },
      });

      // Handle case where user is not found
      if (!foundAccount) {
        return res.status(404).send({ error: "User not found" });
      }

      // Return the user data
      return { user: foundAccount };
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return res.status(500).send({ error: "Internal Server Error" });
    }
  });
};

export default privateRoutes;
