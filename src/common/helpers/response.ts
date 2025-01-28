import { Response } from 'express';

export const sendJsonResponse = (
  res: Response,
  data: any,
  status: number = 200,
) => {
  res
    .status(status)
    .setHeader('Content-Type', 'application/json')
    .setHeader('Cache-Control', 'no-store')
    .json(data);
};
