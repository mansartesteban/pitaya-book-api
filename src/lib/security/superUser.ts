// middlewares/verifyAdmin.ts
import { FastifyRequest, FastifyReply } from "fastify";

export const superUser = (app) => {
  return async (req: FastifyRequest, res: FastifyReply) => {
    try {
      const auth = req.headers.authorization;
      const token = auth?.split(" ")[1];
      if (!token) return res.code(401).send({ error: "Unauthorized" });

      const decoded = app.jwt.verify(token, process.env.JWT_SECRET);
      if (typeof decoded === "object" && decoded.role !== "admin") {
        return res.code(403).send({ error: "Forbidden" });
      }
    } catch (err) {
      return res.code(401).send({ error: "Invalid token" });
    }
  };
};
