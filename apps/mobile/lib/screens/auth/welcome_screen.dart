import 'package:flutter/material.dart';
import '../../../widgets/shared_widgets.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ScreenBackground(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Image.asset(
            'assets/images/slcg_logo.png',
            height: 100,
            fit: BoxFit.contain,
            errorBuilder: (context, error, stackTrace) => const Icon(Icons.anchor, size: 80, color: Colors.amber),
          ),
          const SizedBox(height: 24),
          const Text(
            "SLCG Whale-Watching And Boat Monitoring Platform",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 32),
          const Text(
            "Sign In To Your Account Or Create One To Securely Access The Complete Whale-Watching And Boat Monitoring Platform From Anywhere.",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: Colors.white70, height: 1.5),
          ),
          const SizedBox(height: 32),
          CyanButton(text: "Log In", onPressed: () => Navigator.pushNamed(context, '/login')),
          const SizedBox(height: 16),
          CyanButton(text: "Sign Up", onPressed: () => Navigator.pushNamed(context, '/signup_step1')),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}