import 'package:flutter/material.dart';
import '../../widgets/shared_widgets.dart';
import '../../services/api_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _isLoggingIn = false;

  Future<void> _handleLogin() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text;

    if (username.isEmpty || password.isEmpty || _isLoggingIn) return;
    setState(() => _isLoggingIn = true);

    try {
      final role = await ApiService.instance.login(username, password);
      if (!mounted) return;
      final route = switch (role) {
        'ShoreCrew' => '/shore_dashboard',
        'ShoreWildlife' => '/shore_wildlife',
        'BoatOwner' => '/boat_owner',
        'BoatCrew' => '/boat_crew',
        _ => null
      };
      if (route == null) {
        await ApiService.instance.logout();
        throw Exception(
            '$role accounts use the web portal. Flutter supports Shore Crew, Wildlife Shore, Boat Owner, and Boat Crew accounts.');
      }
      Navigator.pushNamedAndRemoveUntil(context, route, (_) => false);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Colors.redAccent),
      );
    } finally {
      if (mounted) setState(() => _isLoggingIn = false);
    }
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScreenBackground(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Welcome Back!", style: authHeadingStyle()),
          const SizedBox(height: 8),
          Text("Continue Where You Left Off With Secure Account Access.",
              style: authSubheadingStyle(fontSize: 14)),
          const SizedBox(height: 32),
          CustomTextField(
              hintText: "Enter email or user name",
              controller: _usernameController),
          CustomTextField(
              hintText: "Password",
              isPassword: true,
              controller: _passwordController),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () {},
              child: const Text("Forgot password?",
                  style: TextStyle(color: Colors.white54)),
            ),
          ),
          const SizedBox(height: 16),
          CyanButton(
              text: _isLoggingIn ? "Connecting..." : "Log In",
              onPressed: () => _handleLogin()),
          const SizedBox(height: 16),
          Center(
            child: GestureDetector(
              onTap: () =>
                  Navigator.pushReplacementNamed(context, '/signup_step1'),
              child: Text.rich(
                const TextSpan(
                  text: "Don't have an account? ",
                  children: [
                    TextSpan(
                        text: "Sign Up",
                        style: TextStyle(color: Color(0xFF6FFFE9)))
                  ],
                ),
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: Colors.white54),
              ),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
