export interface PassengerData {
  id: string;
  name: string;
  identificationNumber: string;
  phoneNumber: string;
  passengerType: "local" | "foreign";
  countryCode?: string;
  gender: "male" | "female" | "other";
  ageCategory: "adult" | "child" | "small" | "specialneeds";
  specialNeedType?: string;
  selfCareConfirmed?: boolean;
}
