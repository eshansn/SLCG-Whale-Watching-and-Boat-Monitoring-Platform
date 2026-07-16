import 'package:flutter/material.dart';
import '../../../widgets/owner_layout.dart'; // Import to access the shared OwnerDrawer

class BoatOwnerDashboard extends StatelessWidget {
  const BoatOwnerDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: ThemeData.light().copyWith(
        scaffoldBackgroundColor: const Color(0xFFF4F6F9), 
        primaryColor: const Color(0xFF152238), 
      ),
      child: Scaffold(
        endDrawer: const OwnerDrawer(), // Added the shared drawer here!
        body: Stack(
          children: [
            Positioned(
              top: 0, left: 0, right: 0, height: 350,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Image.asset('assets/images/bg_whale.jpg', fit: BoxFit.cover, alignment: Alignment.topCenter),
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter, end: Alignment.bottomCenter,
                        colors: [
                          Colors.white.withValues(alpha: 0.3),
                          const Color(0xFFF4F6F9).withValues(alpha: 0.8),
                          const Color(0xFFF4F6F9),
                        ],
                        stops: const [0.0, 0.7, 1.0],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Icon(Icons.notifications_none, size: 28, color: Color(0xFF152238)),
                        // Made the Hamburger Menu Interactive
                        Builder(
                          builder: (context) => GestureDetector(
                            onTap: () => Scaffold.of(context).openEndDrawer(),
                            child: const Icon(Icons.menu, size: 32, color: Color(0xFF152238)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        Container(
                          width: 64, height: 64,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2),
                            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 8)],
                          ),
                          child: ClipOval(
                            child: Image.asset(
                              'assets/images/profile_kamal.jpg', fit: BoxFit.cover,
                              errorBuilder: (c, e, s) => const Icon(Icons.person, size: 40, color: Colors.grey),
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text("Welcome Back", style: TextStyle(fontSize: 12, color: Colors.black54)),
                            Text("Kamal Silva", style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.black)),
                          ],
                        )
                      ],
                    ),
                    const SizedBox(height: 32),
                    const Text("My Boats", style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.black)),
                    const SizedBox(height: 16),
                    _buildBoatCard(context, name: "Mirissa King", regNo: "SL-WB-2047", imagePath: 'assets/images/fv_mirissa_king.jpg'),
                    const SizedBox(height: 16),
                    _buildBoatCard(context, name: "Sea Princess", regNo: "SL-WB-2038", imagePath: 'assets/images/sea_princess.jpg'),
                    const SizedBox(height: 24),
                    _buildOngoingTripsCard(context), // Pass context here
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBoatCard(BuildContext context, {required String name, required String regNo, required String imagePath}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 4,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text("Name", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black)),
                    const SizedBox(height: 4),
                    Text(name, style: const TextStyle(fontSize: 16, color: Colors.black87)),
                    const SizedBox(height: 12),
                    const Text("Reg No", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black)),
                    const SizedBox(height: 4),
                    Text(regNo, style: const TextStyle(fontSize: 14, color: Colors.black87)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF34D399), shape: BoxShape.circle)),
                        const SizedBox(width: 6),
                        const Text("APPROVED", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF34D399))),
                      ],
                    )
                  ],
                ),
              ),
              Expanded(
                flex: 5,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.asset(
                    imagePath, height: 110, fit: BoxFit.cover,
                    errorBuilder: (c, e, s) => Container(height: 110, color: Colors.blueGrey.shade100, child: const Center(child: Icon(Icons.directions_boat, color: Colors.white))),
                  ),
                ),
              )
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity, height: 44,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF152238), foregroundColor: Colors.white),
              onPressed: () => Navigator.pushNamed(context, '/owner_boat_info'), // Navigates to Boat info
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [Text("Info"), SizedBox(width: 8), Icon(Icons.info_outline, size: 16)],
              ),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildOngoingTripsCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text("Ongoing Trips", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black)),
              Icon(Icons.directions_boat_outlined, color: Colors.grey.shade800),
            ],
          ),
          const SizedBox(height: 24),
          _buildTripListItem(context, "Mirissa King", "SL-WB-2047"),
          const SizedBox(height: 16),
          _buildTripListItem(context, "Sea Princess", "SL-WB-2048"),
        ],
      ),
    );
  }

  Widget _buildTripListItem(BuildContext context, String name, String regNo) {
    // Wrapped in InkWell to make the row tap-able
    return InkWell(
      onTap: () => Navigator.pushNamed(context, '/owner_trip_info'), // Navigates to Trip details
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.black)),
                const SizedBox(height: 4),
                Text(regNo, style: const TextStyle(fontSize: 10, color: Colors.black54)),
              ],
            ),
            Icon(Icons.info_outline, color: Colors.grey.shade800),
          ],
        ),
      ),
    );
  }
}