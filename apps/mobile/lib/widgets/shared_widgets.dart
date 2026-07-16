import 'package:flutter/material.dart';

class ScreenBackground extends StatelessWidget {
  final Widget child;
  final String imagePath; 

  const ScreenBackground({
    Key? key, 
    required this.child, 
    this.imagePath = 'assets/images/bg_whale.jpg' 
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(imagePath, fit: BoxFit.cover),
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.transparent, 
                  Colors.black.withOpacity(0.8), 
                  Colors.black
                ],
                stops: const [0.3, 0.7, 1.0],
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
              child: Column(
                children: [
                  Expanded(child: child),
                  const SizedBox(height: 16),
                  const Text(
                    "Copyright © Sri Lanka Coast Guard 2026 | Designed and maintained by Sri Lanka Coast Guard Information Technology Department",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 10, 
                      color: Colors.white54,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class CyanButton extends StatelessWidget {
  final String text;
  final VoidCallback onPressed;
  final IconData? icon;

  const CyanButton({
    Key? key, 
    required this.text, 
    required this.onPressed, 
    this.icon
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF6FFFE9),
          foregroundColor: Colors.black,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.0)),
        ),
        onPressed: onPressed,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(text, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            if (icon != null) ...[
              const SizedBox(width: 8), 
              Icon(icon, size: 24)
            ],
          ],
        ),
      ),
    );
  }
}

class CustomTextField extends StatelessWidget {
  final String hintText;
  final bool isPassword;
  final TextEditingController? controller;

  const CustomTextField({
    Key? key, 
    required this.hintText, 
    this.isPassword = false,
    this.controller,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16.0),
      child: TextField(
        controller: controller,
        obscureText: isPassword,
        style: const TextStyle(color: Colors.black),
        decoration: InputDecoration(
          hintText: hintText,
          hintStyle: TextStyle(color: Colors.grey.shade600),
          filled: true,
          fillColor: Colors.white,
          suffixIcon: isPassword 
              ? const Icon(Icons.visibility_off, color: Colors.black54) 
              : null,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8.0), 
            borderSide: BorderSide.none
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 18.0),
        ),
      ),
    );
  }
}