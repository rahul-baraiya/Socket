import express, { Request, Response, NextFunction } from "express";
import { app, server } from "./socket/socket";

const port = process.env.PORT || 8080;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.all("*", (req: Request, res: Response, next: NextFunction) => {
  const err: any = new Error(`Can't find ${req.originalUrl} on the server.`);
  err.status = "Fail to load..";
  err.statusCode = 404;
  next(err);
});

app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  error.statusCode = error.statusCode || 400;
  error.status = error.status || "Error";
  res.status(error.statusCode).json({
    success: false,
    status: error.statusCode,
    message: error.message,
  });
});

server.listen(port, () => {
  console.log(`Server is running on port number : ${port}`);
});
