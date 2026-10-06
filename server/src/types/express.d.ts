import type { IUserDocument } from "../features/user/user.model.js";

declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
    }
  }
}

export {};