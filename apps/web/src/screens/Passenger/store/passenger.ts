export interface PassengerData {
  id: string;
  name: string;
  identificationNumber: string;
  phoneNumber: string;
  passengerType: "local" | "foreign";
  gender: "male" | "female" | "other";
  ageCategory: "adult" | "child";
}