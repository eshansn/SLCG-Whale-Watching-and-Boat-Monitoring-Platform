import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class VesselDetailsScreen extends StatelessWidget {
  const VesselDetailsScreen({Key? key}) : super(key: key);

  void _showApprovalPopup(BuildContext context, bool isApproved, String tripId) async {
    await ApiService.instance.approve(tripId, isApproved ? 'Approved' : 'Rejected');
    if (!context.mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: Container(
            width: 400,
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: isApproved ? const Color(0xFF34D399) : Colors.red, shape: BoxShape.circle),
                  child: Icon(isApproved ? Icons.check : Icons.priority_high, color: Colors.white, size: 40),
                ),
                const SizedBox(height: 24),
                Text(
                  isApproved ? "APPROVED" : "DECLINED",
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: isApproved ? const Color(0xFF34D399) : Colors.red),
                ),
                const SizedBox(height: 16),
                Text(isApproved ? "Ride Successfully Authorized" : "Ride Not Authorized", style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Text(
                  isApproved 
                      ? "Authorization has been completed successfully. All required checks have been verified." 
                      : "The authorization request has been declined. The applicant must resolve the identified issues before submitting a new request.",
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.grey, height: 1.5),
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: isApproved ? const Color(0xFF34D399) : Colors.red, foregroundColor: Colors.white),
                    onPressed: () {
                      Navigator.pop(context);
                      Navigator.pushReplacementNamed(context, '/trips_list');
                    },
                    child: const Text("Continue", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                )
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final trip=(ModalRoute.of(context)?.settings.arguments as Map<String,dynamic>?) ?? const <String,dynamic>{};
    return Theme(
      data: ThemeData.light().copyWith(
        scaffoldBackgroundColor: const Color(0xFFEBECEF), 
        primaryColor: const Color(0xFF152238),
      ),
      child: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Image.asset('assets/images/slcg_logo.png', height: 40, errorBuilder: (c,e,s) => const Icon(Icons.anchor)),
                    Row(
                      children: [
                        GestureDetector(
                          onTap: () => Navigator.pushReplacementNamed(context, '/shore_dashboard'),
                          child: const Text("Home", style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w500)),
                        ),
                        const SizedBox(width: 24),
                        const Text("Settings", style: TextStyle(color: Color(0xFF152238), fontWeight: FontWeight.w500)),
                        const SizedBox(width: 24),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF152238), foregroundColor: Colors.white),
                          onPressed: () => Navigator.pushReplacementNamed(context, '/'),
                          child: const Text("Log Out"),
                        )
                      ],
                    )
                  ],
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 3,
                        child: Container(
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                          child: SingleChildScrollView(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                ClipRRect(
                                  borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                                  child: Image.asset(
                                    'assets/images/fv_mirissa_king.jpg',
                                    height: 200,
                                    width: double.infinity,
                                    fit: BoxFit.cover,
                                    errorBuilder: (context, error, stackTrace) => Container(
                                      height: 200, color: Colors.blueGrey,
                                      child: const Center(child: Icon(Icons.directions_boat, size: 80, color: Colors.white54)),
                                    ),
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.all(16.0),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(trip['vessel']?.toString() ?? 'Vessel', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                                      Text("${trip['reg'] ?? ''}   ${trip['status'] ?? ''}", style: const TextStyle(color: Colors.green, fontSize: 12)),
                                      const SizedBox(height: 16),
                                      _buildStatRow("Coordinates", "5.949186, 80.438509"), 
                                      _buildStatRow("Departure", trip['time']?.toString() ?? 'TBA'),
                                      _buildStatRow("Arrival", "DNA"),
                                      const Divider(height: 32),
                                      const Text("Vessel Information", style: TextStyle(fontWeight: FontWeight.bold)),
                                      const SizedBox(height: 8),
                                      _buildStatRow("Length", "12.8 M"),
                                      _buildStatRow("Beam (Width)", "3.9 M"),
                                      _buildStatRow("Cruising Speed", "20 Knots"),
                                      _buildStatRow("Maximum Capacity", "35 Passengers"),
                                      _buildStatRow("Life Jackets", "37"),
                                      const Divider(height: 32),
                                      const Text("Crew Information", style: TextStyle(fontWeight: FontWeight.bold)),
                                      const SizedBox(height: 8),
                                      _buildStatRow("Life Savers", "03"),
                                      _buildStatRow("Divers", "02"),
                                    ],
                                  ),
                                )
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        flex: 7,
                        child: Column(
                          children: [
                            Expanded(
                              flex: 1,
                              child: Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text("Passengers", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                                    Expanded(
                                      child: SingleChildScrollView(
                                        child: DataTable(
                                          columns: const [
                                            DataColumn(label: Text('Name')),
                                            DataColumn(label: Text('NIC or PassPort')),
                                            DataColumn(label: Text('Age')),
                                            DataColumn(label: Text('Nationality')),
                                          ],
                                            rows: const [],
                                        ),
                                      ),
                                    )
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            Expanded(
                              flex: 1,
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    flex: 2,
                                    child: Container(
                                      padding: const EdgeInsets.all(16),
                                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text("Crew", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                                          Expanded(
                                            child: SingleChildScrollView(
                                              child: DataTable(
                                                columns: const [
                                                  DataColumn(label: Text('Name')),
                                                  DataColumn(label: Text('NIC')),
                                                  DataColumn(label: Text('Role')),
                                                  DataColumn(label: Text('Certified')),
                                                ],
                                                rows: const [],
                                              ),
                                            ),
                                          )
                                        ],
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    flex: 1,
                                    child: Container(
                                      padding: const EdgeInsets.all(16),
                                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text("Approval", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                                          const SizedBox(height: 8),
                                          const Text(
                                            "Inspection completed. The information entered in the system has been verified against the actual vessel, and all safety requirements have been met.",
                                            style: TextStyle(fontSize: 12, color: Colors.grey),
                                          ),
                                          const Spacer(),
                                          SizedBox(
                                            width: double.infinity,
                                            child: ElevatedButton(
                                              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF34D399), foregroundColor: Colors.white),
                                              onPressed: () => _showApprovalPopup(context, true, trip['id']?.toString() ?? ''),
                                              child: const Text("Approved"),
                                            ),
                                          ),
                                          const SizedBox(height: 8),
                                          SizedBox(
                                            width: double.infinity,
                                            child: ElevatedButton(
                                              style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
                                              onPressed: () => _showApprovalPopup(context, false, trip['id']?.toString() ?? ''),
                                              child: const Text("Not Approved"),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            )
                          ],
                        ),
                      )
                    ],
                  ),
                )
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF152238), fontWeight: FontWeight.w500)),
          Text(value, style: const TextStyle(color: Colors.grey)),
        ],
      ),
    );
  }

}
