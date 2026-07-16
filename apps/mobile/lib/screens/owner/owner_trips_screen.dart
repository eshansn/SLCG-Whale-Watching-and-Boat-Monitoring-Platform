import 'package:flutter/material.dart';
import '../../../widgets/owner_layout.dart';

class OwnerTripsScreen extends StatelessWidget {
  const OwnerTripsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return OwnerLayout(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Start New Trips Banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: const Color(0xFF152238), // Dark Navy
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  const Text("Start New Trips!", style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(height: 8),
                  const Text(
                    "Set up the schedule and preferences\nfor an upcoming tour.",
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF152238),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () => Navigator.pushNamed(context, '/owner_new_trip'),
                      child: const Text("Schedule Trip", style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  )
                ],
              ),
            ),
            const SizedBox(height: 32),
            
            const Text("My Trips", style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.black)),
            const SizedBox(height: 16),
            
            // Search and Sort
            Row(
              children: [
                Expanded(
                  child: TextField(
                    decoration: InputDecoration(
                      hintText: "Search",
                      hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
                      prefixIcon: const Icon(Icons.search, color: Colors.grey, size: 20),
                      border: InputBorder.none,
                    ),
                  ),
                ),
                const Icon(Icons.mic_none, color: Colors.grey, size: 20),
                const SizedBox(width: 16),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    children: [
                      Text("Sort by : Name", style: TextStyle(fontSize: 10, color: Colors.black87)),
                      SizedBox(width: 4),
                      Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.black87)
                    ],
                  ),
                )
              ],
            ),
            const SizedBox(height: 24),

            // Trip Cards
            _buildTripCard(context, name: "Mirissa King", time: "06:30 AM", imagePath: 'assets/images/fv_mirissa_king.jpg', status: "APPROVED"),
            const SizedBox(height: 16),
            _buildTripCard(context, name: "Mirissa King", time: "10:30 AM", imagePath: 'assets/images/fv_mirissa_king.jpg', status: "APPROVED"),
          ],
        ),
      ),
    );
  }

  Widget _buildTripCard(BuildContext context, {required String name, required String time, required String imagePath, required String status}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8, offset: const Offset(0, 4))],
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
                    const Text("Boat", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black)),
                    const SizedBox(height: 4),
                    Text(name, style: const TextStyle(fontSize: 16, color: Colors.black87)),
                    const SizedBox(height: 12),
                    const Text("Time", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black)),
                    const SizedBox(height: 4),
                    Text(time, style: const TextStyle(fontSize: 14, color: Colors.black87)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF34D399), shape: BoxShape.circle)),
                        const SizedBox(width: 6),
                        Text(status, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF34D399))),
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
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF152238), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
              onPressed: () => Navigator.pushNamed(context, '/owner_trip_info'),
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
}