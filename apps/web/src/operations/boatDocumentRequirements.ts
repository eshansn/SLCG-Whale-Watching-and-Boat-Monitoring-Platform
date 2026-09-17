export interface BoatDocumentRequirement {
  documentType: string;
  name: string;
  renewable: boolean;
  imageOnly?: boolean;
}

export const boatDocumentRequirements: readonly BoatDocumentRequirement[] = [
  { documentType: 'VesselPhotographOrDiagram', name: 'Color Aerial Photograph or Diagram of the Vessel', renewable: false, imageOnly: true },
  { documentType: 'BusinessRegistration', name: 'Certificate of Registration of Sole Proprietorship / Business', renewable: false },
  { documentType: 'MECertificate', name: 'ME Certificate', renewable: true },
  { documentType: 'VesselInsuranceCertificate', name: 'Vessel Insurance Certificate', renewable: true },
  { documentType: 'PassengerLifeInsuranceCertificate', name: "Passengers' Life Insurance Certificate", renewable: true },
  { documentType: 'WildlifeCertificate', name: 'Wildlife Certificate', renewable: false },
  { documentType: 'CoxswainCertificate', name: 'Coxswain Certificate', renewable: false },
  { documentType: 'VesselRegistrationCertificate', name: 'Vessel Registration Certificate', renewable: true },
  { documentType: 'LifeSavingCertificate', name: 'Life Saving Certificate', renewable: false },
  { documentType: 'FirstAidCertificate', name: 'First Aid Certificate', renewable: true },
  { documentType: 'FireFightingEquipmentReport', name: 'Fire-Fighting Equipment Report', renewable: true },
  { documentType: 'FireFightingCertificate', name: 'Fire Fighting Certificate', renewable: false },
] as const;

export const MAX_BOAT_DOCUMENT_BYTES = 10 * 1024 * 1024;

export function validateBoatDocumentFile(file: File, imageOnly = false): string | undefined {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const acceptedExtensions = new Set(['pdf', 'jpg', 'jpeg', 'png']);
  const acceptedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
  if (file.size <= 0 || file.size > MAX_BOAT_DOCUMENT_BYTES)
    return 'Each document must be between 1 byte and 10 MB.';
  if (!acceptedExtensions.has(extension) || !acceptedTypes.has(file.type))
    return 'Documents must be PDF, JPG/JPEG, or PNG files.';
  if (imageOnly && file.type !== 'image/jpeg' && file.type !== 'image/png')
    return 'The vessel photograph must be a JPG/JPEG or PNG image.';
  return undefined;
}
