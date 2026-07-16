import 'package:flutter/material.dart';
import '../../../widgets/owner_layout.dart';

class OwnerBoatInfoScreen extends StatelessWidget {
  const OwnerBoatInfoScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return OwnerLayout(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
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
                      const Text("Mirissa King", style: TextStyle(fontSize: 16, color: Colors.black87)),
                      const SizedBox(height: 16),
                      const Text("Reg No", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black)),
                      const SizedBox(height: 4),
                      const Text("SL-WB-2047", style: TextStyle(fontSize: 16, color: Colors.black87)),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF34D399), shape: BoxShape.circle)),
                          const SizedBox(width: 6),
                          const Text("CERTIFIED", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF34D399))),
                        ],
                      )
                    ],
                  ),
                ),
                Expanded(
                  flex: 5,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.asset(
                      'assets/images/fv_mirissa_king.jpg',
                      height: 130,
                      fit: BoxFit.cover,
                      errorBuilder: (c, e, s) => Container(height: 130, color: Colors.blueGrey, child: const Center(child: Icon(Icons.directions_boat, color: Colors.white))),
                    ),
                  ),
                )
              ],
            ),
            const SizedBox(height: 32),
            
            const Text("Certifications", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black)),
            const SizedBox(height: 16),
            
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade300, width: 1.5),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  _buildCertCard("Certificate of registration of\nSole Propertiship"),
                  const SizedBox(height: 12),
                  _buildCertCard("ME Certificate"),
                  const SizedBox(height: 12),
                  _buildCertCard("Certificate of Vessel"),
                  const SizedBox(height: 12),
                  _buildCertCard("Wildlife Certificate"),
                  const SizedBox(height: 12),
                  _buildCertCard("Coxswain Certificate"),
                  const SizedBox(height: 12),
                  _buildCertCard("Vessel Registration certificate"),
                ],
              ),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildCertCard(String title) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade200),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        title,
        style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.black87, fontSize: 13, height: 1.3),
      ),
    );
  }
}