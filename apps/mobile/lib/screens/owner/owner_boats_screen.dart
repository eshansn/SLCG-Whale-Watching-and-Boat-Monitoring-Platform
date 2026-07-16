import 'package:flutter/material.dart';
import '../../../widgets/owner_layout.dart';

class OwnerBoatsScreen extends StatelessWidget {
  const OwnerBoatsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return OwnerLayout(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("My Boats", style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.black)),
            const SizedBox(height: 24),
            
            _buildBoatCard(context, name: "Mirissa King", regNo: "SL-WB-2047", imagePath: 'assets/images/fv_mirissa_king.jpg', status: "CERTIFIED"),
            const SizedBox(height: 16),
            _buildBoatCard(context, name: "Sea Princess", regNo: "SL-WB-2038", imagePath: 'assets/images/sea_princess.jpg', status: "CERTIFIED"),
            const SizedBox(height: 32),
            
            // Add New Boat Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF1F2937), // Dark grey/navy
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  const Text("Register New Boats", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(height: 8),
                  const Text("Initialize your boat's digital profile.", style: TextStyle(color: Colors.white70, fontSize: 12)),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF1F2937),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () => Navigator.pushNamed(context, '/owner_new_boat'),
                      child: const Text("Add More", style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  )
                ],
              ),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildBoatCard(BuildContext context, {required String name, required String regNo, required String imagePath, required String status}) {
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
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0F172A), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
              onPressed: () {},
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