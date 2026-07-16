import { useParams } from "react-router-dom";
import Navbar from "./components/Navbar";
import TripOverview from "./components/TripOverview";
export default function OPSTripdetails(){const{tripId="1"}=useParams();return <div className="min-h-screen bg-[#eeeeee] font-[Poppins] text-[#14223d]"><Navbar/><TripOverview tripId={tripId}/></div>}
