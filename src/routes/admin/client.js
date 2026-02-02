const adminClientRoutes = async (app) => {
  app.get("/", async (req, res) => {
    res.code(200).send({ clients: [] })
  })
}

export default adminClientRoutes
