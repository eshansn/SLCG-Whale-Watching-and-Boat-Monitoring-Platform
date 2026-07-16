import 'package:flutter/material.dart';

class ShoreDashboard extends StatelessWidget {
  const ShoreDashboard({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: ThemeData.light().copyWith(
        scaffoldBackgroundColor: const Color(0xFFEBECEF),
        primaryColor: const Color(0xFF152238), 
      ),
      child: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(32.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Image.asset('assets/images/slcg_logo.png', height: 50, errorBuilder: (c,e,s) => const Icon(Icons.anchor)),
                    Row(
                      children: [
                        const Icon(Icons.notifications_none, color: Color(0xFF152238)),
                        const SizedBox(width: 24),
                        GestureDetector(
                          onTap: () => Navigator.pushNamed(context, '/trips_list'),
                          child: const Text("Trips", style: TextStyle(color: Color(0xFF152238), fontWeight: FontWeight.w500)),
                        ),
                        const SizedBox(width: 24),
                        const Text("Settings", style: TextStyle(color: Color(0xFF152238), fontWeight: FontWeight.w500)),
                        const SizedBox(width: 24),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF152238), foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                          ),
                          onPressed: () => Navigator.pushReplacementNamed(context, '/'),
                          child: const Text("Log Out"),
                        )
                      ],
                    )
                  ],
                ),
                const SizedBox(height: 48),
                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 1,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text("Hello,", style: TextStyle(fontSize: 24, color: Color(0xFF152238))),
                            const Text("Username!", style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Color(0xFF152238))),
                            const SizedBox(height: 8),
                            const Text("Stay In Control, Stay Connected.", style: TextStyle(color: Colors.grey)),
                            const SizedBox(height: 24),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                              child: const Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text("What's\nNew?", style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF152238))),
                                  SizedBox(height: 24),
                                  Text("02 Trips", style: TextStyle(color: Colors.grey)),
                                  SizedBox(height: 8),
                                  Text("12 Notifications", style: TextStyle(color: Colors.grey)),
                                ],
                              ),
                            )
                          ],
                        ),
                      ),
                      const SizedBox(width: 24),
                      Expanded(
                        flex: 1,
                        child: Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(color: const Color(0xFFEEF2FF), borderRadius: BorderRadius.circular(12)),
                                child: const Icon(Icons.directions_boat_outlined, color: Color(0xFF152238), size: 32),
                              ),
                              const SizedBox(height: 24),
                              const Text("Trips", style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF152238))),
                              const SizedBox(height: 16),
                              const Text("Access all upcoming & completed trips.", style: TextStyle(color: Colors.grey, height: 1.5)),
                              const Spacer(),
                              GestureDetector(
                                onTap: () => Navigator.pushNamed(context, '/trips_list'),
                                child: const Text("View >>", style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF8B93A5))),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 24),
                      Expanded(
                        flex: 2,
                        child: Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text("Scheduled Trips", style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF152238))),
                              const SizedBox(height: 8),
                              const Text("Upcoming trip records.", style: TextStyle(color: Colors.grey)),
                              const SizedBox(height: 24),
                              // Added context here to enable navigation
                              _buildTripListItem(context, "Yet to be approved", Colors.redAccent),
                              const SizedBox(height: 16),
                              _buildTripListItem(context, "Approved", Colors.green),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // Added BuildContext requirement and GestureDetector wrapper
  Widget _buildTripListItem(BuildContext context, String statusText, Color statusColor) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          const Icon(Icons.directions_boat_outlined, color: Color(0xFF152238), size: 32),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("FV Mirissa King", style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF152238))),
                const Text("SL-WB-1234", style: TextStyle(fontSize: 12, color: Colors.grey)),
                const SizedBox(height: 4),
                const Text("06.30 AM, Today", style: TextStyle(fontSize: 12, color: Color(0xFF152238))),
                Text(statusText, style: TextStyle(fontSize: 10, color: statusColor)),
              ],
            ),
          ),
          // Wrapped the visual button in a GestureDetector to make it functional
          GestureDetector(
            onTap: () => Navigator.pushNamed(context, '/vessel_details'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(border: Border.all(color: const Color(0xFF152238)), borderRadius: BorderRadius.circular(20)),
              child: const Text("Info", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF152238))),
            ),
          )
        ],
      ),
    );
  }
}