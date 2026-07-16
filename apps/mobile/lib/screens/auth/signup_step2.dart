import 'package:flutter/material.dart';
import '../../../widgets/shared_widgets.dart';
import '../../../models/signup_data.dart';
import 'signup_step3.dart';

class SignupStep2 extends StatelessWidget {
  final SignupData data;
  const SignupStep2({super.key, required this.data});

  void _selectRoleAndContinue(BuildContext context, String role) {
    data.role = role;
    Navigator.push(context, MaterialPageRoute(builder: (context) => SignupStep3(data: data)));
  }

  @override
  Widget build(BuildContext context) {
    return ScreenBackground(
      imagePath: 'assets/images/bg_whale_boat.jpg', 
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("Tell Us Who You Are!", style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text("Almost There.", style: TextStyle(fontSize: 16, color: Colors.white70)),
          const SizedBox(height: 32),
          CyanButton(text: "Boat Owner", icon: Icons.arrow_circle_right_outlined, onPressed: () => _selectRoleAndContinue(context, "Boat Owner")),
          const SizedBox(height: 16),
          CyanButton(text: "Crew Member", icon: Icons.arrow_circle_right_outlined, onPressed: () => _selectRoleAndContinue(context, "Crew Member")),
          const SizedBox(height: 48),
        ],
      ),
    );
  }
}