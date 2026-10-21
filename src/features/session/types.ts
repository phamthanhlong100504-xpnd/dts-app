export type LearnerProfile = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  selectedLicenseClass: string | null;
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
