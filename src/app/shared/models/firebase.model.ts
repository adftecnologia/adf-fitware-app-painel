import { User } from 'firebase/auth';

export type ICurrentUserFirebase = User | null | undefined;

export type IUserProfileUpdate = {
  nome: string;
  foto?: string | null;
};
