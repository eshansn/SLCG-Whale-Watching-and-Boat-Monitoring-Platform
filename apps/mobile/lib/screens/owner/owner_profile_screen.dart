import 'package:flutter/material.dart';
import '../../../widgets/owner_layout.dart';

class OwnerProfileScreen extends StatelessWidget {
  const OwnerProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return OwnerLayout(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundImage: const AssetImage('assets/images/profile_kamal.jpg'),
                  onBackgroundImageError: (e, s) {},
                  child: const Icon(Icons.person, color: Colors.transparent), // Fallback handled by Flutter if asset fails
                ),
                const SizedBox(width: 16),
                const Text("Kamal Silva", style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.black)),
              ],
            ),
            const SizedBox(height: 32),
            
            _buildLabel("NIC No."),
            _buildTextField("091019029019"),
            
            _buildLabel("Your Email"),
            _buildTextField("xxx@gmail.com", icon: Icons.mail_outline),
            
            _buildLabel("Phone Number"),
            _buildTextField("+941234567", icon: Icons.phone_outlined),
            
            _buildLabel("About"),
            _buildTextField("Hi , This is a demo.", maxLines: 3),
            
            const SizedBox(height: 48),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F172A), // Deep Navy
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () {},
                child: const Text("Update", style: TextStyle(fontSize: 16)),
              ),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0, top: 16.0),
      child: Text(text, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)),
    );
  }

  Widget _buildTextField(String hint, {IconData? icon, int maxLines = 1}) {
    return TextField(
      maxLines: maxLines,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: Colors.grey.shade500),
        prefixIcon: icon != null ? Icon(icon, color: Colors.grey.shade400) : null,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.grey.shade200),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF152238)),
        ),
      ),
    );
  }
}