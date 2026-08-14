import { useParams } from "react-router-dom";
import TripOverview from "../OPS/components/TripOverview";
export default function AdminTripDetailsPage(){const{tripId="1"}=useParams();return <div className="admin-trip-readonly min-h-[calc(100vh-64px)] bg-[#eeeeee] font-[Poppins] text-[#14223d]"><TripOverview tripId={tripId}/></div>}
