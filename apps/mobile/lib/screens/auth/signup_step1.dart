import 'package:flutter/material.dart';
import '../../../widgets/shared_widgets.dart';
import '../../../models/signup_data.dart';
import 'signup_step2.dart';

class SignupStep1 extends StatelessWidget {
  const SignupStep1({super.key});

  @override
  Widget build(BuildContext context) {
    final signupData = SignupData(); 

    return ScreenBackground(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("Let's Get Started!", style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text("Just Few Steps Away.", style: TextStyle(fontSize: 16, color: Colors.white70)),
          const SizedBox(height: 32),
          const CustomTextField(hintText: "Enter Username"),
          const CustomTextField(hintText: "Enter Email"),
          const CustomTextField(hintText: "Enter Phone"),
          const SizedBox(height: 16),
          CyanButton(
            text: "Continue",
            icon: Icons.arrow_circle_right_outlined,
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (context) => SignupStep2(data: signupData))),
          ),
          const SizedBox(height: 16),
          Center(
            child: GestureDetector(
              onTap: () => Navigator.pushReplacementNamed(context, '/login'),
              child: const Text("Got an account? Sign In", style: TextStyle(color: Colors.white54)),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}