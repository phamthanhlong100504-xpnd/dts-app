export type LearnerProfile = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  selectedLicenseClass: string | null;
  birthOfDate?: string | null;
  phoneNumber?: string | null;
  emailVerifiedAt?: string | null;
  status?: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  profile: LearnerProfile;
};

export type LicenseItem = {
  code: string;
  title: string;
  description: string;
};
