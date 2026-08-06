import 'package:flutter/material.dart';
import '../../../widgets/shared_widgets.dart';
import '../../../models/signup_data.dart';

class SignupStep3 extends StatelessWidget {
  final SignupData data;
  const SignupStep3({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    return ScreenBackground(
      imagePath: 'assets/images/bg_whale_boat.jpg',
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Let's Get You Secured!", style: authHeadingStyle()),
          const SizedBox(height: 8),
          Text("One Last Step.", style: authSubheadingStyle()),
          const SizedBox(height: 32),
          const CustomTextField(hintText: "New Password", isPassword: true),
          const CustomTextField(hintText: "Confirm Password", isPassword: true),
          const SizedBox(height: 16),
          CyanButton(
            text: "Create Account",
            icon: Icons.arrow_circle_right_outlined,
            onPressed: () =>
                debugPrint("Creating account for Role: ${data.role}"),
          ),
          const SizedBox(height: 48),
        ],
      ),
    );
  }
}
